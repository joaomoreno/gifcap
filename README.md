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