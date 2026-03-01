// Ce layout est maintenant un passthrough : le header est géré par portal/layout.tsx
export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
