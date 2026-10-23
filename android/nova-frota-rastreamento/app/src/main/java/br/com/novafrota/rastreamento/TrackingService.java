package br.com.novafrota.rastreamento;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TrackingService extends Service implements LocationListener {
    static final String ACTION_START = "br.com.novafrota.rastreamento.START";
    static final String ACTION_STOP = "br.com.novafrota.rastreamento.STOP";
    static final String EXTRA_TOKEN = "token";
    static final String PREFS = "rastreamento";
    static final String KEY_ACTIVE = "active";
    static final String CHANNEL = "gps-ativo";
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private LocationManager locationManager;
    private String token;
    private long lastSentElapsed = 0;
    private boolean stopping = false;

    @Override public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Rastreamento em andamento",
                NotificationManager.IMPORTANCE_LOW));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopTracking();
            return START_NOT_STICKY;
        }
        if (intent == null || !ACTION_START.equals(intent.getAction())) {
            stopTracking();
            return START_NOT_STICKY;
        }
        token = intent.getStringExtra(EXTRA_TOKEN);
        if (token == null || !token.matches("[a-fA-F0-9]{64}")) {
            stopTracking();
            return START_NOT_STICKY;
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopTracking();
            return START_NOT_STICKY;
        }
        Notification notification = notification("GPS ativo • Enviando localização da viagem");
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(1001, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(1001, notification);
            }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, true).apply();
            subscribeLocation();
        } catch (SecurityException | IllegalArgumentException e) {
            stopTracking();
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    private Notification notification(String message) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, TrackingService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 1, stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Nova Frota • Rastreamento ativo")
                .setContentText(message)
                .setContentIntent(openPending)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .addAction(android.R.drawable.ic_media_pause, "Encerrar rastreamento", stopPending)
                .build();
    }

    private void subscribeLocation() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 30000L, 20f,
                    this, Looper.getMainLooper());
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                && locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 30000L, 20f,
                    this, Looper.getMainLooper());
        }
    }

    @Override public void onLocationChanged(Location location) {
        if (stopping || token == null || !location.hasAccuracy()) return;
        long current = SystemClock.elapsedRealtime();
        if (lastSentElapsed != 0 && current - lastSentElapsed < 30000L) return;
        lastSentElapsed = current;
        String access = token;
        double lat = location.getLatitude(), lng = location.getLongitude();
        float accuracy = location.getAccuracy();
        network.submit(() -> {
            ApiClient.Result result = ApiClient.sendPosition(access, lat, lng, accuracy);
            if (result.terminal) {
                android.os.Handler handler = new android.os.Handler(Looper.getMainLooper());
                handler.post(this::stopTracking);
            }
        });
    }

    private void stopTracking() {
        if (stopping) return;
        stopping = true;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply();
        if (locationManager != null) locationManager.removeUpdates(this);
        token = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply();
        if (locationManager != null) locationManager.removeUpdates(this);
        network.shutdown();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
