package br.com.novafrota.rastreamento;

import org.json.JSONObject;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class ApiClient {
    private static final String BASE = "https://api.portalfrete.net.br";
    static final class Result {
        final boolean ok;
        final String message;
        final boolean terminal;
        Result(boolean ok, String message, boolean terminal) {
            this.ok = ok; this.message = message; this.terminal = terminal;
        }
    }
    static Result validate(String token) {
        try {
            JSONObject body = new JSONObject().put("token", token);
            JSONObject response = post("/v1/monitor/driver", body);
            if (!response.optBoolean("ok")) return new Result(false, response.optString("error", "Link inválido."), true);
            JSONObject trip = response.optJSONObject("trip");
            if (trip == null) return new Result(false, "Viagem não encontrada.", true);
            if (!trip.optBoolean("active", false)) return new Result(false, "Esta viagem está encerrada.", true);
            String route = trip.optString("plate") + " • " + trip.optString("driver") + "\n"
                    + trip.optString("origin") + " → " + trip.optString("destination");
            return new Result(true, route, false);
        } catch (Exception e) {
            return new Result(false, "Não foi possível verificar o link. Confira a internet.", false);
        }
    }
    static Result sendPosition(String token, double lat, double lng, float accuracy) {
        try {
            JSONObject body = new JSONObject().put("token", token)
                    .put("latitude", lat).put("longitude", lng).put("accuracy", accuracy);
            JSONObject response = post("/v1/monitor/position", body);
            if (response.optBoolean("ok")) return new Result(true, "Posição enviada.", false);
            String message = response.optString("error", "Falha no envio.");
            boolean terminal = message.contains("expirado") || message.contains("inválido")
                    || message.contains("encerrada");
            return new Result(false, message, terminal);
        } catch (Exception e) {
            return new Result(false, "Sem conexão com o servidor.", false);
        }
    }
    private static JSONObject post(String path, JSONObject body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(BASE + path).openConnection();
        conn.setRequestMethod("POST");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        conn.setRequestProperty("Accept", "application/json");
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream out = conn.getOutputStream()) { out.write(payload); }
        InputStream stream = conn.getResponseCode() >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (stream == null) { conn.disconnect(); throw new IllegalStateException("Resposta vazia"); }
        byte[] bytes;
        try (InputStream in = stream) { bytes = in.readAllBytes(); }
        conn.disconnect();
        return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
    }
}
