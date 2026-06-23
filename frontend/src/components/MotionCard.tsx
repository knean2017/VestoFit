"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function MotionCard({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      onClick={onClick}
      className={"card " + className}
      whileHover={reduce ? undefined : { y: -2, boxShadow: "0 8px 32px rgba(42, 37, 34, 0.10)" }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}
