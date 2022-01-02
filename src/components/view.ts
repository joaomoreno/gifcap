import m from "mithril";

interface ViewAttrs {
  readonly contentClass?: string;
  readonly contentProps?: object;
  readonly actions: m.Children;
}

export default class View implements m.ClassComponent<ViewAttrs> {
  view(vnode: m.Vnode<ViewAttrs>) {
    return m("section", { class: "view" }, [
      m(
        "section",
        {
          class: `content ${vnode.attrs.contentClass || ""}`,
          ...(vnode.attrs.contentProps || {}),
        },
        vnode.children
      ),
      m("section", { class: "actions" }, vnode.attrs.actions),
    ]);
  }
}
