package horanet.hframework.hauth;

import static horanet.hframework.hauth.BuildConfig.DEBUG;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.text.TextUtils;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.Objects;

/**
 * Handling network operations
 */
public class HttpConnection {
    private static final String TAG = HAuth.TAG + "/" + HttpConnection.class.getSimpleName();

    private final String stringURL;
    private final String method;
    private final String body;
    private HttpURLConnection httpConn;
    private final HAuth hAuth;

    /**
     * TODO update progresses and errors to SyncWorker
     *
     * @param route       route to call to host
     * @param routeParams http params for route.
     * @param httpMethod  GET, POST ...
     * @param body        request body
     */
    public HttpConnection(Context context, String route, JSONObject routeParams, String httpMethod, String body) throws IOException {
        String server = getHostFromSharedPreference(context);
        this.method = httpMethod;
        this.body = body;
        // Build URL from server and route
        Uri.Builder builder = Uri.parse(server).buildUpon();
        String[] routes = route.replace("//", "/").split("/");
        for (String r : routes) {
            builder.appendPath(r);
        }
        if (routeParams != null && routeParams.length() > 0) {
            Iterator<String> iterator = routeParams.keys();
            while (iterator.hasNext()) {
                String key = iterator.next();
                try {
                    builder.appendQueryParameter(key, routeParams.getString(key));
                } catch (JSONException e) {
                    // Something went wrong!
                }
            }
        }
        stringURL = builder.build().toString();
        Log.i(TAG, "[" + this.method + "] " + stringURL);
        hAuth = Objects.requireNonNull(HAuth.getInstance(context));
        setupHttpURLConnection();
    }

    private String getHostFromSharedPreference(Context context) {
        String server = "";
        SharedPreferences sharedPreferences = context.getSharedPreferences(HAuth.SHARED_PREFS, Context.MODE_PRIVATE);
        server = sharedPreferences.getString(HAuth.SHARED_PREFS_SERVER, "");
        if (TextUtils.isEmpty(server))
            Log.e(TAG, "Error: wrong server URL.");
        return server;
    }

    private HttpURLConnection setupHttpURLConnection() {
        try {
            URL url = new URL(this.stringURL);
            httpConn = (HttpURLConnection) url.openConnection();
            //setup method and header
            httpConn.setRequestMethod(method);
            httpConn.setConnectTimeout(3000);
            httpConn.setRequestProperty("Content-Type", "application/json");
            hAuth.setupAuthBasic(httpConn);
            // set output
            Log.d(TAG, "setupHttpURLConnection methode " + method);
            if (!"GET".equals(this.method)) {
                httpConn.setDoOutput(true);
                if (body != null) {
                    Log.d(TAG, "setupHttpURLConnection write data to OutputStream");
                    OutputStream outputStream = httpConn.getOutputStream();
                    outputStream.write(body.getBytes());
                    outputStream.flush();
                    outputStream.close();
                }
            }
            Log.d(TAG, "setupHttpURLConnection set output OK");
        } catch (IOException e) {
            Log.e(TAG, "Error: setupHttpURLConnection " + e.getClass().getSimpleName());
            //if (DEBUG)
                e.printStackTrace();
        }
        return httpConn;
    }

    /**
     * Get response code from server. In case of HttpURLConnection.HTTP_UNAUTHORIZED, try to get next password then retry a new HttpUrlConnection.
     *
     * @return HAuth return code or Http response code.
     */
    public int getResCodeWithRetry() throws IOException {
        Log.d(TAG, "getResCodeWithRetry begin");
        int code = hAuth.getResCode(httpConn);
        if (code == HAuth.MISSING_PASSWORD || code == HAuth.INVALID_PASSWORD) {
            //disconnect old connection
            httpConn.disconnect();
            // retry with a new connection
            httpConn = setupHttpURLConnection();
            code = httpConn.getResponseCode();
            Log.w(TAG, "retry: res code " + code);
        }
        Log.d(TAG, "getResCodeWithRetry end");
        return code;
    }

    /**
     * Get response data, can be called only after network connection established
     *
     * @return
     * @throws IOException
     */
    public String getResponseData() throws IOException {
        InputStream inputStream = httpConn.getInputStream();
        BufferedReader br = new BufferedReader(new InputStreamReader(inputStream));
        String line;
        String resData = "";

        while ((line = br.readLine()) != null) {
            resData += line;
        }
        br.close();
        return resData;
    }

    /**
     * Disconnect from server
     */
    public void disconnect() {
        httpConn.disconnect();
    }

    public int getContentLength() {
        return httpConn.getContentLength();
    }

    public void setConnectTimeout(int milliSeconds) {
        try {
            httpConn.setConnectTimeout(milliSeconds);
        } catch (Exception e) {
            Log.e(TAG, "Error: " + e.getMessage());
            if (DEBUG) e.printStackTrace();
        }
    }

    public HttpURLConnection getHttpURLConnection() {
        return httpConn;
    }
}
