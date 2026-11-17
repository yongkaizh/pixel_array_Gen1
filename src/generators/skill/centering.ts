import { LayoutConfig } from "../../types";
import { nominalCenter } from "../../math/layout";
import { SkillBuilder } from "./SkillBuilder";

export function generateCentering(builder: SkillBuilder, config: LayoutConfig): void {
  const center = nominalCenter(config);
  builder.append(`
    ; --- Center Array at (0, 0) based on target layer ---
    layer_bBox = nil
    foreach(item targetInsts
      layer_bBox = paUnionBBox(layer_bBox paMosaicBBox(item))
    )
    if(layer_bBox then
      dx = -(caar(layer_bBox) + caadr(layer_bBox)) / 2.0
      dy = -(cadar(layer_bBox) + cadadr(layer_bBox)) / 2.0
    else
      dx = ${-center.x}
      dy = ${-center.y}
      printf("Fallback mathematical center: cx=%L cy=%L\\n" 0.0 - dx 0.0 - dy)
    )

    foreach(item allInsts
      inst = car(item)
      inst~>xy = list(car(inst~>xy) + dx cadr(inst~>xy) + dy)
    )

    ; Draw verification bounds for each master used by the selected target.
    foreach(item allInsts
      inst = car(item)
      matchesTarget = nil
      foreach(target targetInsts
        when(inst~>libName == car(target)~>libName && inst~>cellName == car(target)~>cellName
          matchesTarget = t
        )
      )
      when(matchesTarget
        bBox = paMosaicBBox(item)
        verificationRect = dbCreateRect(cv list("M1" "pin") bBox)
        when(verificationRect
          dbReplaceProp(verificationRect "pixelArrayVerification" "boolean" t)
        )
      )
    )
    dbSave(cv)
  `);
}
