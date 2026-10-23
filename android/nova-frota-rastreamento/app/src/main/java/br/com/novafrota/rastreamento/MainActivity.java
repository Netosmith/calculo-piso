package br.com.novafrota.rastreamento;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int REQ_LOCATION = 100;
    private static final int REQ_NOTIFICATION = 101;
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private EditText linkInput;
    private TextView status;
    private Button startButton;
    private CheckBox consent;
    private String verifiedToken;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        buildUi();
        consumeLink(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        consumeLink(intent);
    }

    private void buildUi() {
        int blue = Color.rgb(9, 67, 125), green = Color.rgb(10, 132, 80);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(44), dp(24), dp(24));
        root.setBackgroundColor(Color.rgb(241, 247, 252));
        scroll.addView(root);
        TextView title = text("NOVA FROTA", 30, blue, true);
        root.addView(title);
        root.addView(text("RASTREAMENTO DE VIAGENS", 15, blue, true));
        addGap(root, 28);
        root.addView(text("Link da viagem", 16, blue, true));
        root.addView(text("Cole o link recebido no WhatsApp ou abra-o diretamente neste aplicativo.", 14, Color.DKGRAY, false));
        addGap(root, 12);
        linkInput = new EditText(this);
        linkInput.setSingleLine(false);
        linkInput.setMinLines(2);
        linkInput.setTextSize(14);
        linkInput.setHint("https://portalfrete.net.br/pages/monitorar-motorista.html#...");
        root.addView(linkInput, new LinearLayout.LayoutParams(-1, -2));
        addGap(root, 12);
        Button verify = button("Verificar viagem", blue);
        root.addView(verify, new LinearLayout.LayoutParams(-1, dp(52)));
        verify.setOnClickListener(v -> verifyLink());
        addGap(root, 20);
        status = text("Aguardando link de rastreamento.", 15, Color.DKGRAY, false);
        root.addView(status);
        addGap(root, 20);
        consent = new CheckBox(this);
        consent.setText("Autorizo compartilhar minha localização durante esta viagem. Entendo que o GPS continuará ativo com a tela bloqueada e que posso encerrar o rastreamento a qualquer momento.");
        consent.setTextSize(14);
        consent.setChecked(false);
        root.addView(consent);
        addGap(root, 16);
        startButton = button("INICIAR RASTREAMENTO", green);
        startButton.setEnabled(false);
        root.addView(startButton, new LinearLayout.LayoutParams(-1, dp(56)));
        startButton.setOnClickListener(v -> startWithPermission());
        consent.setOnCheckedChangeListener((b, checked) -> startButton.setEnabled(checked && verifiedToken != null));
        addGap(root, 12);
        Button stop = button("ENCERRAR RASTREAMENTO", Color.rgb(166, 37, 57));
        root.addView(stop, new LinearLayout.LayoutParams(-1, dp(50)));
        stop.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Encerrar rastreamento?")
                .setMessage("O aplicativo deixará de enviar sua localização para esta viagem.")
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Encerrar", (d, w) -> {
                    stopService(new Intent(this, TrackingService.class));
                    getSharedPreferences(TrackingService.PREFS, MODE_PRIVATE).edit()
                            .putBoolean(TrackingService.KEY_ACTIVE, false).apply();
                    status.setText("Rastreamento encerrado neste celular.");
                }).show());
        addGap(root, 24);
        root.addView(text("Durante o rastreamento, o Android exibirá uma notificação permanente. Sem internet, o envio será retomado quando uma nova posição for obtida com conexão. O aplicativo piloto ainda não guarda o histórico offline.", 12, Color.GRAY, false));
        setContentView(scroll);
    }

    private void consumeLink(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data != null && data.getFragment() != null) {
            linkInput.setText(data.toString());
            verifyLink();
        }
    }

    private String parseToken(String input) {
        String value = input == null ? "" : input.trim();
        int hash = value.lastIndexOf('#');
        if (hash >= 0) value = value.substring(hash + 1);
        if (!value.matches("[a-fA-F0-9]{64}")) return null;
        return value.toLowerCase(java.util.Locale.ROOT);
    }

    private void verifyLink() {
        String token = parseToken(linkInput.getText().toString());
        verifiedToken = null;
        startButton.setEnabled(false);
        if (token == null) {
            status.setText("Link inválido. Cole o link completo enviado pela Nova Frota.");
            return;
        }
        status.setText("Verificando viagem...");
        network.submit(() -> {
            ApiClient.Result result = ApiClient.validate(token);
            runOnUiThread(() -> {
                if (result.ok) {
                    verifiedToken = token;
                    status.setText("VIAGEM CONFIRMADA\n" + result.message);
                    startButton.setEnabled(consent.isChecked());
                } else status.setText(result.message);
            });
        });
    }

    private void startWithPermission() {
        if (verifiedToken == null || !consent.isChecked()) return;
        boolean fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            return;
        }
        startTracking();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(requestCode, permissions, grants);
        if (requestCode == REQ_LOCATION) {
            boolean allowed = false;
            for (int result : grants) if (result == PackageManager.PERMISSION_GRANTED) allowed = true;
            if (allowed) startTracking();
            else status.setText("Permissão de localização negada. O rastreamento não foi iniciado.");
        }
    }

    private void startTracking() {
        if (verifiedToken == null || !consent.isChecked()) return;
        try {
            Intent intent = new Intent(this, TrackingService.class)
                    .setAction(TrackingService.ACTION_START)
                    .putExtra(TrackingService.EXTRA_TOKEN, verifiedToken);
            startForegroundService(intent);
            status.setText("Rastreamento iniciado. Você pode bloquear a tela. Verifique a notificação de GPS ativo.");
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATION);
            }
        } catch (RuntimeException e) {
            status.setText("Não foi possível iniciar o serviço GPS. Verifique as permissões do Android.");
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (status != null && getSharedPreferences(TrackingService.PREFS, MODE_PRIVATE)
                .getBoolean(TrackingService.KEY_ACTIVE, false)) {
            status.setText("Rastreamento ativo neste celular. Acompanhe pelo Portal Frete.");
        }
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(null, Typeface.BOLD);
        return view;
    }
    private Button button(String label, int color) {
        Button view = new Button(this);
        view.setText(label);
        view.setAllCaps(false);
        view.setTextColor(Color.WHITE);
        view.setBackgroundTintList(android.content.res.ColorStateList.valueOf(color));
        return view;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void addGap(LinearLayout root, int value) {
        View gap = new View(this);
        root.addView(gap, new LinearLayout.LayoutParams(1, dp(value)));
    }
}
