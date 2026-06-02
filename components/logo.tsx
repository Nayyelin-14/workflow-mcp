import Link from "next/link";
import React from "react";

const Logo = () => {
  return (
    <Link href="/workflow" className="flex items-center gap-1">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        <span>F</span>
      </div>
      <div className="flex items-center">
        <span className="font-black text-primary text-lg">Flow</span>
        <span className="font-black text-foreground text-lg">agent.ai</span>
      </div>
    </Link>
  );
};

export default Logo;
