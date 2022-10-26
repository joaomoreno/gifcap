<h2 align="center">Gifcap</h2>

<img align="center" src="https://user-images.githubusercontent.com/22350/119881198-4d861b00-bf2d-11eb-866b-9607b6da676a.png">

<div align="center">

Record your screen into an animated GIF, all you need is a browser!

[![License][1]][2] [![Github Repo Size][3]][4] [![Github Contributors][5]][6] [![Github Last Commit][7]][8] [![Build][11]][12]

</div>

## Overview

### Tech Stack

- [Node](https://nodejs.org/) - JavaScript runtime environment

### Included Tooling

- [TypeScript](https://www.typescriptlang.org/) - Type checking
- [Prettier](https://prettier.io/) - Code formatting

## Installation

```bash
git clone https://github.com/joaomoreno/gifcap.git
```

- `cd` into your project directory and run `npm i`.
- Run `npm run build` and `npm run start` to start the development server.
- Open your browser to `http://localhost:5000` to see the included example code running.

## Commands

- `npm run dev` - Starts the development server.
- `npm run build` - Builds a compiled version of your app.

**Features:**

- No installations, no bloatware, no updates: this works in any modern browser, including Google Chrome, Firefox, Edge and Safari;
- No server side, everything is **100% client-side only**. All data stays in your machine, nothing gets uploaded to any server, the entire application is made of static files;
- PWA support makes it easy to add gifcap to your OS list of applications;
- Blazing fast GIF rendering powered by WASM, [libimagequant](https://github.com/ImageOptim/libimagequant) and [gifsicle](https://github.com/kohler/gifsicle);
- Highly optimized GIF file sizes, thanks to frame deduplication, boundary delta detection and lossy encoding;
- Entire screen recordings, or selection of single window;
- Intuitive trimming UI
- Easy cropping via visual drag-and-drop

<br>

[1]: https://img.shields.io/github/license/joaomoreno/gifcap
[2]: https://github.com/joaomoreno/gifcap/blob/master/LICENSE.md "License"
[3]: https://img.shields.io/github/repo-size/joaomoreno/gifcap "Repo Size"
[4]: https://github.com/joaomoreno/gifcap
[5]: https://img.shields.io/github/contributors/joaomoreno/gifcap "Contributors"
[6]: https://github.com/joaomoreno/gifcap/graphs/contributors
[7]: https://img.shields.io/github/last-commit/joaomoreno/gifcap "Last Commit"
[8]: https://github.com/joaomoreno/gifcap/graphs/commit-activity
[10]: https://github.com/joaomoreno/gifcap/issues "Issues"
[11]: https://github.com/joaomoreno/gifcap/actions/workflows/build.yml/badge.svg
[12]: https://github.com/joaomoreno/gifcap/actions/workflows/build.yml