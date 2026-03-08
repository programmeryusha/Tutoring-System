"use client";
import { useEffect, useRef } from "react";

export function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "-30px" }
    );

    const el = ref.current;
    if (el) {
      const children = el.querySelectorAll(".animate-on-scroll");
      children.forEach((child) => observer.observe(child));
      // Also observe the container itself if it has the class
      if (el.classList.contains("animate-on-scroll")) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, []);

  return ref;
}

export function ScrollAnimationWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useScrollAnimation();
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
