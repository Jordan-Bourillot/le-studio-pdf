const Views = {
  current: null,
  show(name) {
    if (this.current === name) return;
    document.querySelectorAll(".view").forEach((v) => {
      v.hidden = true;
    });
    const el = document.getElementById(`view-${name}`);
    if (!el) return;
    el.hidden = false;
    this.current = name;
    window.scrollTo({ top: 0, behavior: "auto" });
    document.dispatchEvent(new CustomEvent("viewenter", { detail: { name } }));
  },
};
