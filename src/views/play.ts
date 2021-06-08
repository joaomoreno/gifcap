import m from "mithril";
import { App, Gif } from "../app";
import Button from "../components/button";
import Timer from "../components/timer";
import View from "../components/view";

function humanSize(size: number): string {
  if (size < 1024) {
    return "1 KB";
  }

  size = Math.round(size / 1024);
  return size < 1024 ? `${size} KB` : `${Math.floor((size / 1024) * 100) / 100} MB`;
}

interface PlayViewAttrs {
  readonly app: App;
  readonly gif: Gif;
}

export default class PlayView implements m.ClassComponent<PlayViewAttrs> {
  private readonly app: App;
  private readonly gif: Gif;

  constructor(vnode: m.CVnode<PlayViewAttrs>) {
    this.app = vnode.attrs.app;
    this.gif = vnode.attrs.gif;
  }

  view() {
    const actions = [
      m(Button, {
        label: "Download",
        icon: "download",
        a: {
          href: this.gif.url,
          download: "recording.gif",
          target: "_blank",
        },
        primary: true,
      }),
      m(Button, {
        label: "Edit",
        icon: "pencil",
        onclick: () => this.app.editGif(),
      }),
      m(Button, {
        label: "Discard",
        icon: "trashcan",
        onclick: () => this.app.discardGif(),
      }),
    ];

    return [
      m(
        View,
        { actions },
        m(".recording-card", [
          m(
            "a",
            {
              href: this.gif.url,
              download: "recording.gif",
              target: "_blank",
            },
            [m("img.recording", { src: this.gif.url })]
          ),
          m("footer", [
            m(Timer, { duration: this.gif.duration }),
            m("span.tag.is-small", [
              m(
                "a.recording-detail",
                {
                  href: this.gif.url,
                  download: "recording.gif",
                  target: "_blank",
                },
                [
                  m("img", {
                    src: "https://icongr.am/octicons/download.svg?size=16&color=333333",
                  }),
                  humanSize(this.gif.size),
                ]
              ),
            ]),
          ]),
        ])
      ),
    ];
  }
}
