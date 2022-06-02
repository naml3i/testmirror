package horanet.hframework.hauth;

import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStreamReader;

import static horanet.hframework.hauth.BuildConfig.DEBUG;

/**
 * Class for system utilities
 */
public class SystemUtils {
    private static final String TAG = HAuth.TAG + SystemUtils.class.getSimpleName();
    private static final int RETRY_LIMIT = 5;

    /**
     * Get the built-in serial number which was written to ROM.
     * Furthermore, this operation is quite expensive, so we should call this once then store
     * the returned serial number into somewhere else.
     *
     * @return Return the serial number as a string or return null in case of any error
     */
    public static String getBuiltinSerialNumber() {
        String[] cmdArr = new String[]{"sh", "-c", "prodid -std"};
        String prodId = null;
        int retry = 0;
        while (prodId == null && retry < RETRY_LIMIT) {
            prodId = validProdId(exeCommand(cmdArr, ""));
            retry++;
        }
        Log.i(TAG, "HTab's serial number " + prodId);
        return prodId;
        // return Build.SERIAL; // If we return this value, we will get the ID of processor
    }

    /**
     * Execute a command in system level
     *
     * @param command A system-level command
     * @param match   Use to find the command result matching with a given pattern, use "" to skip pattern search (take the first line if found)
     * @return Return the command result, return null in case of any error or no result found
     */
    public static String exeCommand(String[] command, CharSequence match) {
        try {
            // Return null if no result found
            String result = null;

            // Execute the command
            Process process = Runtime.getRuntime().exec(command);

            // Wait until getting the result
            int exitValue = process.waitFor();

            // If there is no error, get the result
            if (exitValue == 0) {
                BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                String line;
                while ((line = bufferedReader.readLine()) != null) {
                    // If match is "", return the first result
                    if (match == "") {
                        result = line;
                        break;
                    }

                    // Otherwise return the result matching with the given pattern
                    if (line.contains(match) == true) {
                        result = line;
                        break;
                    }
                }
            }

            return result;
        } catch (Exception e) {
            Log.e(TAG, e.getClass().getSimpleName());
            if (DEBUG)
                e.printStackTrace();
            return null;
        }
    }

    public static String validProdId(String prodId) {
        if (prodId != null) {
            prodId = prodId.trim().replaceAll(System.lineSeparator(), "");
        }
//        Log.d(TAG, "HTab's serial number " + prodId + "!");
        return (prodId != null && prodId.length() == 10 && prodId.matches("[0-9A-Z]+")) ? prodId : null;
    }

/*
    public static int executeCmd(String[] cmd) {

        int err = 1;
        if (cmd == null)
            return err;

        try {

            Process p = Runtime.getRuntime().exec(cmd);
            err = p.waitFor();

            if (err == 0) {
                SLog.i(cmd[cmd.length - 1] + " [OK]");
            } else {
                SLog.e(err, cmd[cmd.length - 1] + " [KO]");
            }

        } catch (IOException | InterruptedException e) {
            SLog.log(e);
            //TODO: ADD ERROR HERE ? Usefull function ? because exeCommand is doing the same thing but better
        }

        return err;
    }
*/
}
