import m from "mithril";

interface ButtonAttrs {
  readonly a?: any;
  readonly primary?: boolean;
  readonly title?: string;
  readonly label?: string;
  readonly outline?: boolean;
  readonly iconset?: string;
  readonly disabled?: boolean;
  readonly icon: string;
  readonly onclick?: Function;
}

export default class Button implements m.ClassComponent<ButtonAttrs> {
  view(vnode: m.Vnode<ButtonAttrs>) {
    if (vnode.attrs.a) {
      return m(
        "a",
        {
          class: `button ${vnode.attrs.primary ? "primary" : "secondary"} ${vnode.attrs.label ? "" : "icon-only"} ${
            vnode.attrs.outline ? "outline" : ""
          }`,
          ...vnode.attrs.a,
        },
        [
          m("img", {
            src: `/${vnode.attrs.iconset || "media"}/${vnode.attrs.icon}-16-${
              vnode.attrs.outline ? "333" : "fff"
            }.svg`,
          }),
          vnode.attrs.label,
        ]
      );
    } else {
      return m(
        "button",
        {
          class: `button ${vnode.attrs.primary ? "primary" : "secondary"} ${vnode.attrs.label ? "" : "icon-only"} ${
            vnode.attrs.outline ? "outline" : ""
          }`,
          onclick: vnode.attrs.onclick,
          title: vnode.attrs.title || vnode.attrs.label,
          disabled: vnode.attrs.disabled,
        },
        [
          m("img", {
            src: `/${vnode.attrs.iconset || "media"}/${vnode.attrs.icon}-16-${
              vnode.attrs.outline ? "333" : "fff"
            }.svg`,
          }),
          vnode.attrs.label,
        ]
      );
    }
  }
}
