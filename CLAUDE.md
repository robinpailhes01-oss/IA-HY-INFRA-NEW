@AGENTS.md

# Système de montage vidéo — Harmonie Yacht (puis clients)

Les vidéos sont écrites en HTML avec HyperFrames (HeyGen) et rendues en MP4.
Les projets vidéo vivent dans `videos/<nom-du-projet>/`, séparés du site Next.js.
Les skills HyperFrames sont dans `.claude/skills/` : les utiliser avant d'écrire une composition (`/hyperframes` est le point d'entrée).
Répondre à Robin en français, simplement, en expliquant chaque étape en une phrase.

## Règles créatives (toutes les vidéos)

1. **Accroche dans les 2 premières secondes** : un visuel fort et/ou un texte d'accroche visible dès la seconde 0, jamais d'intro lente ni de logo seul.
2. **Texte lisible sur mobile** : corps de texte ≥ 60 px sur un canvas 1080×1920, titres ≥ 90 px, contraste fort (le contrôle WCAG de `check` doit passer), pas plus de 2 lignes courtes à la fois.
3. **Zones sûres du format 9:16 (1080×1920)** : tout le visible reste dans la zone « action-safe » (marge de 5 %, soit 54 px) ; le texte et le contenu clé restent dans la zone « title-safe » (marge de 10 %, soit 108 px sur les côtés et 192 px en haut et en bas). Éviter de poser du texte dans le bas de l'écran, là où les applications (Instagram, TikTok, Reels) affichent légende et boutons.
4. **2 polices maximum** par vidéo (une pour les titres, une pour le texte). Toute police nommée doit être déclarée avec `@font-face` vers un fichier local.

## Règles de production

5. **Avant tout rendu, toujours** : `npx hyperframes lint`, puis `npx hyperframes check`, puis `npx hyperframes snapshot` (et regarder les images). Ne rendre que si tout passe.
6. Itérer avec `--quality draft`, premier vrai rendu en `--quality looks`, livraison finale en `--quality delivery`.
7. Ne jamais rendre sans l'accord de Robin sur l'aperçu final.
8. Les rendus vont dans `videos/<projet>/renders/`. Ne pas committer les médias sources lourds (photos/vidéos de clients) : ils restent sur Google Drive.

## Règle d'or : ne jamais inventer d'informations sur les yachts

Ne jamais inventer ni deviner **prix, capacité, nombre de cabines, longueur, vitesse, équipements, destinations, disponibilités** ou toute autre caractéristique d'un yacht.
N'utiliser que les informations fournies par Robin ou lues dans un document fourni. Si une information manque, laisser un champ clairement marqué `[À CONFIRMER]` et le signaler à Robin, plutôt que de la remplir.
