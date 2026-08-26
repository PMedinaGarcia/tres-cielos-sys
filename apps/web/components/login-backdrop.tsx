import Image from "next/image";

export function LoginBackdrop() {
  return (
    <div className="login-backdrop" aria-hidden>
      <div className="login-backdrop__photo-wrap">
        <Image
          src="/venue/login-bg.jpeg"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="login-backdrop__photo"
        />
      </div>
      <div className="login-backdrop__sun" />
      <div className="login-backdrop__caustics" />
      <div className="login-backdrop__shimmer" />
      <div className="login-backdrop__particles">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="login-backdrop__veil" />
    </div>
  );
}
