import { HomePage } from "@/components/home-page";

/**
 * `/demo` — the home page, in demo mode. The studio here is laced with the
 * scripted account and generates against a fixed evidence store; synthesis is
 * still a real model call. Shareable as-is: this URL *is* the demo.
 */
export const metadata = {
  title: "Demo",
  description:
    "See ARGUS write a cited pre-meeting brief live, from a fixed set of public sources.",
};

export default function Demo() {
  return <HomePage demo />;
}
