# Sources des médias (non committés)

Les médias lourds ou protégés ne sont pas dans le dépôt. Pour reconstruire le projet :

## Musique — `assets/bgm.mp3`

Extraite du reel de référence envoyé par Robin le 07/10/2026 (paroles : début de *Losing My Religion*, R.E.M. — identification faite à partir des paroles).
`ffmpeg -i <reel_reference.mp4> -vn -c:a libmp3lame -b:a 256k assets/bgm.mp3`
Droits : publier la version sans le son et ajouter le même son dans Instagram.

## Rushes — originaux iPhone (HDR HLG) sur Google Drive

| N° | Fichier | Drive ID | Résolution | Utilisé pour |
|---|---|---|---|---|
| 01 | IMG_0560.MOV | 1a4DED3nWIO6WJ57BbZ3YYcUewEGoQkEG | 1080×1920, 30 i/s | (non utilisé : tête sous le texte) |
| 02 | IMG_0568.MOV | 1I083kA1POfmqJIxSD6UUWUnqeeut_Ggy | 1080×1920, 29,97 i/s | plan 02 |
| 03 | IMG_0561.MOV | 1faHMA0v8VmKH_y0119o3P4Q_em-ZnkMh | 1080×1920, 30 i/s | plan 08 |
| 04 | IMG_0555.MOV | 1HHo1zBzm5dj069TZVGVbGhUVbZgxo3qQ | 1080×1920, 29,97 i/s | plan 03 |
| 05 | IMG_0556.MOV | 1dwuaVd4AYfB53iKD5o-KlhkOQZw4ZPCi | 1080×1920, 30 i/s | plan 05 |
| 06 | IMG_0565.MOV | 1D23ZpaZNA9jdvvx1s9ipRYPrdO5i9J5q | 1080×1920, 29,97 i/s | plan 07 |
| 07 | IMG_0557.MOV | 1u6NlkK8e7nI0xK0weuJkOnx2_wRV1aAi | 1080×1920, 30 i/s | plan 04 |
| 08 | IMG_0569.MOV | 1znuK6mKOkqTmbIswjlUVzeVwIvVd8alt | 1080×1920, 29,97 i/s | plan 06 |
| 09 | IMG_0175.MOV | 13cE_1zjuN2J-XP0x3HIDE8s0GU5iegkA | 2160×3840, 59,94 i/s | plan 10 |
| 10 | IMG_0177.MOV | 1WhaZQsmMCEB39TE4k0j51LPiCm71uycc | 2160×3840, 59,94 i/s | plan 09 |
| 11 | IMG_0176.MOV | 1wliaV1ZYn4o_c00EZmVChAxFajtuakNm | 2160×3840, 120 i/s | plan 01 |

Téléchargement : `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`
Rangement attendu : `<dossier_drive>/<NN>-<ID>/<fichier>.MOV`, puis `bash tools/prep_clips.sh <dossier_drive> assets/rushes`.
