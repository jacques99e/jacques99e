/** Ouvre un lien de partage sans perdre le texte (window.open + noopener casse souvent WhatsApp/Facebook sur mobile). */
export function openShareLink(url: string) {
  if (typeof document === "undefined" || !url) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
