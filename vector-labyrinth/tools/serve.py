#!/usr/bin/env python3
"""Local study server with room for parallel ES-module requests."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.wgsl': 'text/plain'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    with Server(('127.0.0.1', args.port), partial(Handler, directory=str(root))) as server:
        print(f'EIGENGOTT vector study: http://127.0.0.1:{args.port}/vector-labyrinth/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
