"""
Restaure les zones blanches INTERIEURES (visage de Bertrand) qui ont ete
rendues transparentes par erreur lors du retrait du fond.

Strategie : flood fill depuis les bords pour identifier les pixels transparents
connectes a l exterieur. Tous les pixels transparents NON connectes a l exterieur
sont des trous interieurs (le visage du blaireau) et sont remplis en blanc.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ASSETS = Path(r"C:\Users\jorda\Downloads\Triskell 4 - Studio PDF\ui\assets")
FILES = [
    "bertrand_greeting.png",
    "bertrand_success.png",
    "bertrand_logo.png",
    "bertrand_working.png",
    "bertrand_confused.png",
]


def fix_inner_holes(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    h, w = alpha.shape

    # BFS depuis tous les pixels du bord qui sont transparents
    visited = np.zeros_like(alpha, dtype=bool)
    q = deque()

    for y in range(h):
        for x in (0, w - 1):
            if alpha[y, x] < 50 and not visited[y, x]:
                q.append((y, x))
                visited[y, x] = True
    for x in range(w):
        for y in (0, h - 1):
            if alpha[y, x] < 50 and not visited[y, x]:
                q.append((y, x))
                visited[y, x] = True

    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and alpha[ny, nx] < 50:
                visited[ny, nx] = True
                q.append((ny, nx))

    # Pixels transparents NON visites = trous interieurs â†’ remplir blanc
    mask = (alpha < 50) & ~visited
    arr[mask] = [255, 245, 232, 255]  # ivoire (correspond au visage original)

    Image.fromarray(arr).save(path, "PNG")
    print(f"OK : {path.name} ({mask.sum()} pixels restaures)")


def main() -> None:
    for f in FILES:
        p = ASSETS / f
        if not p.exists():
            print(f"!! introuvable : {f}")
            continue
        fix_inner_holes(p)


if __name__ == "__main__":
    main()
