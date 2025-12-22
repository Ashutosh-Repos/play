"use client";

import { useState, useRef, useEffect } from "react";

export const useScrollDirection = (
  scrollRef: React.RefObject<HTMLElement | null>
) => {
  const [show, setShow] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const element = scrollRef.current;

    const onScroll = () => {
      let y: number;
      if (element) {
        y = element.scrollTop;
      } else {
        y = window.scrollY;
      }
      const isScrollingUp = y < lastY.current || y < 60;
      setShow(isScrollingUp);
      lastY.current = y;
    };

    if (element) {
      element.addEventListener("scroll", onScroll, { passive: true });
      return () => element.removeEventListener("scroll", onScroll);
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
  }, [scrollRef]);

  return show;
};
