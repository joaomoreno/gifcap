import m from "mithril";

interface OnboardingAttrs {
  readonly src?: string;
  readonly alt?: string;
  readonly class?: string;
}

export default class Onboarding implements m.ClassComponent<OnboardingAttrs> {
  view(vnode: m.Vnode<OnboardingAttrs>) {
    return m("img", {
      src: vnode.attrs.src || "media/onboarding.gif",
      alt: vnode.attrs.alt || "Onboarding animation",
      class: vnode.attrs.class || "onboarding-gif",
    });
  }
}
