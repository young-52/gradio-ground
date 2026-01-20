import {
  create,
  type ExtractState,
  type StoreApi,
  type UseBoundStore,
} from "zustand";
import { combine } from "zustand/middleware";

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S,
) => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

const sampleCode = `
import gradio as gr

def greet(name, intensity):
    return "Hello, " + name + "!" * int(intensity)

demo = gr.Interface(
    fn=greet,
    inputs=["text", "slider"],
    outputs=["text"],
    api_name="predict"
)

demo.launch()
`.trim();

export type SourceLoc = {
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
};

export const useAppState = createSelectors(
  create(
    combine(
      {
        code: sampleCode,
        currentStep: 0,
        sourceLocs: [] as SourceLoc[],
        runCount: 0,
        lastRunCode: sampleCode,
      },
      (set, get) => ({
        setCode: (code: string) => {
          set({ code });
        },
        setCurrentStep: (step: number) => {
          set({ currentStep: step });
        },
        getCurrentLoc: () => {
          const { sourceLocs, currentStep } = get();
          return sourceLocs[currentStep] || null;
        },
        run: () => {
          set((s) => ({
            runCount: s.runCount + 1,
            lastRunCode: s.code,
          }));
        },
      }),
    ),
  ),
);

export type AppState = ExtractState<typeof useAppState>;
