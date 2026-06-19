declare module "flowtoken/dist/components/SplitText" {
  import type { FC } from "react";

  type SplitTextProps = {
    input: string;
    sep?: "word" | "char" | "diff";
    animation?: string;
    animationDuration?: string;
    animationTimingFunction?: string;
    animationIterationCount?: number;
  };

  const SplitText: FC<SplitTextProps>;
  export default SplitText;
}

declare module "flowtoken/dist/utils/animations" {
  export const animations: Record<string, string>;
}
