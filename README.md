# gifcap

[![Build](https://github.com/joaomoreno/gifcap/actions/workflows/build.yml/badge.svg)](https://github.com/joaomoreno/gifcap/actions/workflows/build.yml)

Record your screen into an animated GIF, all you need is a browser!

👉 [gifcap.dev](https://gifcap.dev/)

[![gifcap screenshot](https://user-images.githubusercontent.com/22350/119881198-4d861b00-bf2d-11eb-866b-9607b6da676a.png)](https://gifcap.dev/)

**Features:**

- No installations, no bloatware, no updates: this works in any modern browser, including Google Chrome, Firefox, Edge and Safari;
- No server side, everything is **100% client-side only**. All data stays in your machine, nothing gets uploaded to any server, the entire application is made of static files;
- PWA support makes it easy to add gifcap to your OS list of applications;
- Blazing fast GIF rendering powered by WASM, [libimagequant](https://github.com/ImageOptim/libimagequant) and [gifsicle](https://github.com/kohler/gifsicle);
- Highly optimized GIF file sizes, thanks to frame deduplication, boundary delta detection and lossy encoding;
- Entire screen recordings, or selection of single window;
- Intuitive trimming UI
- Easy cropping via visual drag-and-drop

## How to build

```sh
docker build -t gifcapbuild encoder
docker run -v "$(pwd):/src" -it gifcapbuild
```
<details><summary>

### How to build when you despise docker... 
</summary>

#### 1. Install necessary tools in eg. Debian:
(Note: `libimagequant` uses `binutils`' [`ar`](https://www.man7.org/linux/man-pages/man1/ar.1.html) in its Makefile, and `emsdk` requires `python` and `xz` to initialize itself - hence they are included here.)
```sh
sudo apt update -y && sudo apt install -y autoconf binutils git make python3 xz-utils
```
#### 2. Initialize userland working directory:
```sh
mkdir ~/src/
```
#### 3. Fetch Emscripten SDK:
(Note: [node.js](https://github.com/nodejs) is bundled within emsdk.)
```sh
cd ~/src/
git clone https://github.com/emscripten-core/emsdk.git
./emsdk/emsdk install latest
./emsdk/emsdk activate latest
. ./emsdk/emsdk_env.sh                 # Inform the current shell environment of emcc & node's existence.
emcc -v; node -v; npm -v               # Test whether emcc, node & npm all actually work.
```
#### 4. Fetch gifcap and also its .gitmodules:
```sh
cd ~/src/
git clone https://github.com/joaomoreno/gifcap.git
git -C ./gifcap/ submodule update --init --recursive
git -C ./gifcap/ submodule status
```
#### 5. Build check for gifsicle:
```sh
cd ~/src/gifcap/encoder/vendor/gifsicle/
autoreconf -i && autoupdate
./configure --disable-gifview --disable-gifdiff --disable-simd --disable-threads CC=emcc
make -C src/ giffunc.o fmalloc.o support.o gifwrite.o gifread.o
```
#### 6. Build check for libimagequant:
```sh
cd ~/src/gifcap/encoder/vendor/libimagequant/
./configure --enable-debug --disable-sse CC=emcc
make static
```
#### 7. Build gifcap's backend encoder as welll as its web frontend:
```sh
cd ~/src/gifcap/encoder
make encoder.js
npm install
npm run build
```
#### 8. Test self-hosted gifcap on [http://localhost:5000](http://localhost:5000) 
```sh
npm run serve                          # Point a web-browser to http://localhost:5000 whilst this is running.
```
</details>
