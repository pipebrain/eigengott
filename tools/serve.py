#!/usr/bin/env python3
"""A localhost-only static server. No installation or build step required."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.wgsl': 'text/plain'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    with ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=str(root))) as server:
        print(f'EIGENGOTT: http://127.0.0.1:{args.port}', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
