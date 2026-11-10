import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "奶蛙在东秦 · 一只奶蛙的校园旅行",
  description: "奶蛙立牌在东北大学秦皇岛分校各自流动。拍下每只奶蛙的下一站，把快乐交给下一个人。",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
