/**
 * Cupón de bienvenida guardado en este navegador. Lo escribe el modal de la tienda (content) y
 * lo lee el formulario de solicitud (sales); el servidor lo valida contra la configuración vigente.
 */
const COUPON_KEY = "blesh.welcomeCoupon";
const SEEN_KEY = "blesh.welcomeSeen";
const CHANGED = "blesh:welcome-coupon-changed";

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* Navegador sin almacenamiento: el cupón solo dura esta visita. */ }
  window.dispatchEvent(new Event(CHANGED));
}

export const welcomeCoupon = {
  get: () => read(COUPON_KEY),
  getServerSnapshot: () => null,
  set: (code: string) => write(COUPON_KEY, code),
  clear: () => write(COUPON_KEY, null),
  /** ¿Ya se mostró la ventana para este código? Un código nuevo vuelve a mostrarse. */
  seen: (code: string) => read(SEEN_KEY) === code,
  markSeen: (code: string) => write(SEEN_KEY, code),
  subscribe(callback: () => void) {
    window.addEventListener("storage", callback);
    window.addEventListener(CHANGED, callback);
    return () => { window.removeEventListener("storage", callback); window.removeEventListener(CHANGED, callback); };
  },
};
