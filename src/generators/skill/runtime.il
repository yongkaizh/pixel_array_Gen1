; Geometry helpers shared by the browser and standalone Python exports.
procedure(paUnionBBox(a b)
  if(a then
    if(b then
      list(list(min(caar(a) caar(b)) min(cadar(a) cadar(b)))
           list(max(caadr(a) caadr(b)) max(cadadr(a) cadadr(b))))
    else a)
  else b)
)

procedure(paLeafShape(path)
  if(listp(path) then paLeafShape(cadr(path)) else path)
)

procedure(paLayerBBox(master lpp)
  let((bounds shape shapeBox path)
    foreach(path dbShapeQuery(master lpp master~>bBox 0 32)
      shape = paLeafShape(path)
      when(shape && member(shape~>objType list("rect" "polygon" "path" "pathSeg" "ellipse" "donut"))
        shapeBox = dbTransformBBox(shape~>bBox dbGetHierPathTransform(path))
        bounds = paUnionBBox(bounds shapeBox)
      )
    )
    bounds
  )
)

; Metadata: instance, configured orientation, local columns/rows, X/Y pitch, reference bbox.
procedure(paMosaicBBox(item)
  let((inst orient cols rows xp yp bounds xy pt)
    inst = car(item)
    orient = cadr(item)
    cols = nth(2 item)
    rows = nth(3 item)
    xp = nth(4 item)
    yp = nth(5 item)
    foreach(pt list(list(0.0 0.0) list((cols - 1) * xp 0.0)
                    list(0.0 (rows - 1) * yp) list((cols - 1) * xp (rows - 1) * yp))
      xy = dbTransformPoint(pt list(inst~>xy orient 1.0))
      bounds = paUnionBBox(bounds dbTransformBBox(nth(6 item) list(xy orient 1.0)))
    )
    bounds
  )
)
