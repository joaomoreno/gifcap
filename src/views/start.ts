import m from "mithril";
import { App } from "../gifcap";
import Button from "../components/button";
import View from "../components/view";

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

interface StartViewAttrs {
  readonly app: App;
}

export default class StartView implements m.ClassComponent<StartViewAttrs> {
  private readonly app: App;

  constructor(vnode: m.CVnode<StartViewAttrs>) {
    this.app = vnode.attrs.app;
  }

  view() {
    return m(View, [
      m("p", "Create animated GIFs from a screen recording."),
      m("p", "Client-side only, no data is uploaded. Modern browser required."),
      isMobile ? m("p", "Sorry, mobile does not support screen recording.") : undefined,
      isMobile
        ? undefined
        : m(Button, {
            label: "Start Recording",
            icon: "play",
            onclick: () => this.app.startRecording(),
            primary: true,
          }),
    ]);
  }
}
