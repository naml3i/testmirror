package horanet.hframework.hauth;

import static horanet.hframework.hauth.BuildConfig.DEBUG;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;
import android.util.Log;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;

public class HAuth {
    public static final String TAG = HAuth.class.getSimpleName();

    static final String MANUFACTURER_HORANET = "Freescale";
    static final String HORANET_PM098 = "PM098-MX6DQ";

    private static final String HTTP_HEAD_X_NEXT_PASSWORD = "X-Next-Password";
    public static final String USER_AGENT_KEY = "User-Agent";
    public static final String USER_AGENT = "Hauth";

    public static final int MISSING_PASSWORD = 1;
    public static final int INVALID_PASSWORD = 2;
    public static final int IO_EXCEPTION = 3;

    public static final String SHARED_PREFS = "hauth";
    public static final String SHARED_PREFS_SERVER = "server_url";
    public static final String SHARED_PREFS_PWD = "password";
    public static final String SHARED_PREFS_LOGIN = "login";
    private static final String SHARED_PREFS_SERIAL = "serial";

    private String pwd = "";

    private String serial = "";
    private static String login = "";
    private static String server = "";
    private static String loginSuffix = "";

    private SharedPreferences sharedPreferences = null;
    private ConnectivityManager connectivityManager;

    private static HAuth hAuth;

    /**
     * @param context: NOT NULL.
     */
    private HAuth(final Context context) {
        Log.d(TAG, "Instantiate HAuth");
        try {
            sharedPreferences = context.getSharedPreferences(SHARED_PREFS, Context.MODE_PRIVATE);
            connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            serial = getSerial(context, sharedPreferences);

            login = sharedPreferences.getString(SHARED_PREFS_LOGIN, "");
            server = sharedPreferences.getString(SHARED_PREFS_SERVER, "");
            pwd = sharedPreferences.getString(HAuth.SHARED_PREFS_PWD, "");

            // On installation, there values may not exist. Write empty value in to shared preference
            SharedPreferences.Editor editor = sharedPreferences.edit();
            if (server.isEmpty())
                editor.putString(HAuth.SHARED_PREFS_SERVER, "");
            if (pwd.isEmpty())
                editor.putString(HAuth.SHARED_PREFS_PWD, "");
            // For the moment, init login with serial first. Prefix and suffix will be added later.
            if (login.isEmpty()) {
                login = serial;
                editor.putString(HAuth.SHARED_PREFS_LOGIN, login);
            }
            editor.apply();

        } catch (NullPointerException e) {
            Log.e(TAG, "Error: invalid context. " + e.getClass().getSimpleName() + ", " + e.getMessage());
            if (DEBUG) e.printStackTrace();
        }
    }

    public static HAuth getInstance(Context context) {
        if (hAuth == null)
            hAuth = new HAuth(context);
        return hAuth;
    }

    public String initLogin(int loginMaxLength, String suffix) {
        loginSuffix = suffix;
        if (!serial.isEmpty()) {
            // add the suffix to the serial
            login = serial + loginSuffix;
            if (login.length() > loginMaxLength) {
                Log.w(TAG, "Login is too long, max length is " + loginMaxLength);
                login = login.substring(0, loginMaxLength);
            }

            // Write the login into shared preferences anyways
            SharedPreferences.Editor editor = sharedPreferences.edit();
            editor.putString(HAuth.SHARED_PREFS_LOGIN, login);
            editor.apply();
            Log.i(TAG, "Wrote login  " + login + " into shared prefs");
        } else
            Log.e(TAG, "Invalid serial");
        return login;
    }

    private String getSerial(Context context, SharedPreferences sharedPreferences) {
        serial = sharedPreferences.getString(HAuth.SHARED_PREFS_SERIAL, "");
        if (serial.isEmpty()) {
            // There is no serial in shared preferences, so get it from the system
            if (Build.MANUFACTURER.equals(MANUFACTURER_HORANET) && Build.MODEL.equals(HORANET_PM098))
                serial = SystemUtils.getBuiltinSerialNumber();
            else if (!Build.SERIAL.equals(Build.UNKNOWN))
                serial = Build.SERIAL;
            else
                serial = Settings.Secure.getString(context.getApplicationContext().getContentResolver(), Settings.Secure.ANDROID_ID);
            Log.i(TAG, "getSerial MANUFACTURER " + Build.MANUFACTURER + " MODEL " + Build.MODEL + " Serial Number " + serial);

            if (serial == null)
                serial = "";

            SharedPreferences.Editor editor = sharedPreferences.edit();
            editor.putString(HAuth.SHARED_PREFS_SERIAL, serial);
            editor.apply();
        }
        return serial;
    }

    public static String getServer() {
        return server;
    }

    public void updateServer(String serverUrl) {
        if (!TextUtils.isEmpty(serverUrl)) {
            Log.i(TAG, "update server " + serverUrl);
            HAuth.server = serverUrl;
            SharedPreferences.Editor editor = sharedPreferences.edit();
            editor.putString(HAuth.SHARED_PREFS_SERVER, server);
            editor.apply();
        } else
            Log.w(TAG, "Warn: server is empty");
    }

    /**
     * Save password into shared preferences
     *
     * @param password
     * @return
     */
    public boolean setPassword(String password) {
        if (password != null && !password.isEmpty()) {
            synchronized (this) {
                pwd = password;
            }
            SharedPreferences.Editor editor = sharedPreferences.edit();
            editor.putString(SHARED_PREFS_PWD, password);
            editor.apply();
            return true;
        } else {
            Log.e(TAG, "Error: invalid password");
            return false;
        }
    }

    /**
     * Send an http request to a server using the param httpConn.
     * If there is a next_password in the response's header, save it.
     *
     * @param httpConn an HttpURLConnection object.
     * @return Return HTTP_OK on success.
     * If HTTP_UNAUTHORIZED is received, then return HAuth.MISSING_PASSWORD or HAuth.INVALID_PASSWORD.
     * Otherwise return the received http code.
     */
    public int getResCode(HttpURLConnection httpConn) {
        int res = IO_EXCEPTION;
        // Setup auth request
        if (isConnected() && httpConn != null) {
            try {
                res = httpConn.getResponseCode();
                // Check X-next-password in the response's header
                String next_pwd = httpConn.getHeaderField(HTTP_HEAD_X_NEXT_PASSWORD);
                if (next_pwd != null && !next_pwd.isEmpty()) {
                    // update pwd for other HAuth objects.
                    synchronized (this) {
                        pwd = next_pwd;
                    }
                    // update pwd in shared preferences
                    SharedPreferences.Editor editor = sharedPreferences.edit();
                    editor.putString(SHARED_PREFS_PWD, next_pwd);
                    editor.apply();
                    Log.i(TAG, "Updated new password into shred prefs");
                }
                switch (res) {
                    case HttpURLConnection.HTTP_OK:
                        Log.d(TAG, "HTTP response code " + res);
                        break;
                    case HttpURLConnection.HTTP_UNAUTHORIZED:
                        // Suppose that login (or serial number) is validated earlier.
                        // So there isn't a case for wrong login.
                        Log.w(TAG, "HTTP response code " + res);
                        Log.w(TAG, "Password seems to be " + (pwd == null || pwd.isEmpty() ? "missing" : "invalid"));
                        res = (pwd == null || pwd.isEmpty() ? MISSING_PASSWORD : INVALID_PASSWORD);
                        break;
                    default:
                        Log.w(TAG, "HTTP response code " + res);
                        break;
                }
            } catch (IOException | NullPointerException e) {
                Log.e(TAG, "Error: getResponseCode " + e.getClass().getSimpleName());
                /*if (DEBUG)*/ e.printStackTrace();
            } // finally: let a caller calls HttpURLConnection.disconnect();
        } else {
            Log.e(TAG, "Error: no connection");
        }
        return res;
    }

    private boolean isConnected() {
        NetworkInfo activeNetwork = connectivityManager.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnectedOrConnecting();
    }

    public String getBasicAuthHeader()
    {
        // Verify login & pwd
        if (login == null || login.isEmpty())
            login = sharedPreferences.getString(SHARED_PREFS_LOGIN, "");
        if (pwd == null || pwd.isEmpty())
            pwd = sharedPreferences.getString(SHARED_PREFS_PWD, "");
        String auth = login + ":" + pwd;
        byte[] encodedAuth = Base64.encode(auth.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);

        return "Basic " + new String(encodedAuth);
    }

    /**
     * Setup user agent & auth basic by adding its into the httpURLConnection's header.
     * initLogin mays be failed. setupAuthBasic could update login.
     *
     * @param httpURLConnection is the HttpURLConnection passed to modify the header.
     */
    void setupAuthBasic(HttpURLConnection httpURLConnection) {
        // Setup auth basic and user agent
        String authHeaderValue = getBasicAuthHeader();
        httpURLConnection.setRequestProperty(USER_AGENT_KEY, System.getProperty("http.agent") + " " + USER_AGENT);
        Log.d(TAG, System.getProperty("http.agent") + " " + USER_AGENT);
        httpURLConnection.setRequestProperty("Authorization", authHeaderValue);
    }

    /**
     * Call init login first.
     *
     * @return a login initialized by initLogin(SharedPreferences)
     */
    public static String getLogin() {
        return login;
    }

    public boolean isPasswordEmpty() {
        return TextUtils.isEmpty(pwd);
    }

    public String getSerialNum() {
        return serial;
    }
}
