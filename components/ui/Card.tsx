import { ReactNode } from "react";

export interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className = "", children }: CardProps) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-card ${className}`}>
      {children}
    </section>
  );
}
