import Image from "next/image";

type Props = {
  /** 导航条默认约 32–36px */
  className?: string;
};

/** 品牌书法「D」标：`public/logo-mark.png` */
export function BrandMark({ className = "" }: Props) {
  return (
    <span
      className={`relative inline-block h-8 w-8 shrink-0 md:h-9 md:w-9 ${className}`}
      aria-hidden
    >
      <Image
        src="/logo-mark.png"
        alt=""
        fill
        className="object-contain object-center"
        sizes="36px"
        priority
      />
    </span>
  );
}
