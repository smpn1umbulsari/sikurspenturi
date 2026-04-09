function showFloatingToast(message = "Tersimpan", type = "success") {
  document.querySelectorAll(".admin-floating-toast").forEach(item => item.remove());

  const toast = document.createElement("div");
  toast.className = `admin-floating-toast ${type === "error" ? "is-error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("is-visible");
  }, 10);

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 260);
  }, 3000);

  return true;
}

function showInlineSaveNotification(target, message = "Tersimpan") {
  const element = typeof target === "string"
    ? document.querySelector(target)
    : target;
  if (!element) return false;
  return showFloatingToast(message);
}

function showInlineSaveNotificationForData(attr, value, message = "Tersimpan") {
  const safeValue = window.CSS?.escape ? CSS.escape(String(value || "")) : String(value || "").replace(/"/g, '\\"');
  return showInlineSaveNotification(`[${attr}="${safeValue}"]`, message);
}
