import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "gradio-lite": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      "gradio-requirements": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      "gradio-file": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          name?: string;
          entrypoint?: boolean;
        },
        HTMLElement
      >;
    }
  }
}
