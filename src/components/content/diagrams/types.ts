/** Shared props for every registered diagram component. */
export type DiagramProps = {
  /**
   * Which structure labels to draw: "all", "none", or an explicit list of structure
   * keys from the registry.
   */
  labels: "all" | "none" | string[];
  /**
   * Structure keys to mark A, B, C… in order, for exam-style "name the structure
   * labelled B" questions. Lettered structures are always drawn, whatever `labels` says.
   */
  letters?: string[];
};
