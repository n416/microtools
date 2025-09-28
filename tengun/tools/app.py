import http.server
import socketserver

PORT = 5501

class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # マルチスレッド(SharedArrayBuffer)を有効にするためのヘッダーを追加
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

# サーバーを起動
with socketserver.TCPServer(("", PORT), MyHttpRequestHandler) as httpd:
    print("サーバーを起動しました: http://127.0.0.1:{}".format(PORT))
    print("必要なヘッダー (COOP/COEP) を追加しています。")
    httpd.serve_forever()