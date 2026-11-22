# Tons de destaque — aprovados (Task 21)

Gerado por `generate.py`. Contraste WCAG 2.x sem arredondar (aqui a 2 casas). Fundos: claro `#FFFFFF` / card `#F5F5F7`; escuro `#1E1E1E` / card `#2A2A2C`. Multicolor → Azul-tinta.

## Regra inferida do azul (tokens.json vs `#007AFF` medido)

OKLCH; ΔL absoluto, C como razão; o matiz é sempre o da cor de entrada (o azul dos tokens desvia ≤ 1,7°, ruído do sRGB).

| Tom | Claro | Escuro |
|---|---|---|
| primary (do medido) | L-0.0731 C×0.872 | L+0.1166 C×0.679 |
| primary-foreground | branco | L=0.2192, C=primary.C×0.414 |
| primary-hover (do primary) | L-0.0417 C×0.914 | L+0.0480 C×0.814 |
| primary-pressed (do primary) | L-0.0842 C×0.826 | L+0.0979 C×0.626 |
| link | = primary | primary L-0.0210 C×1.061 |
| primary-tint | L=0.9395, C=primary.C×0.145 | L=0.3305, C=primary.C×0.477 |
| primary-tint-foreground | primary L-0.0010 C×0.984 | = link |
| ring | = link | = link |

A regra aplicada ao próprio `#007AFF` (matiz mantido), comparada com os tokens (a tabela usa os tokens):

| Modo | Tom | regra | tokens | ΔE×100 |
|---|---|---|---|---|
| claro | primary | `#0366D6` | `#0066D6` | 0.07 |
| claro | primary-foreground | `#FFFFFF` | `#FFFFFF` | 0.00 |
| claro | primary-hover | `#055BBF` | `#005BBF` | 0.13 |
| claro | primary-pressed | `#0650A8` | `#0050A8` | 0.19 |
| claro | link | `#0366D6` | `#0066D6` | 0.07 |
| claro | primary-tint | `#E0ECFE` | `#E0ECFE` | 0.00 |
| claro | primary-tint-foreground | `#0866D4` | `#0666D4` | 0.05 |
| claro | ring | `#0366D6` | `#0066D6` | 0.07 |
| escuro | primary | `#66A5FF` | `#62A6FF` | 0.42 |
| escuro | primary-foreground | `#061A36` | `#051A36` | 0.12 |
| escuro | primary-hover | `#82B5FF` | `#7FB6FF` | 0.38 |
| escuro | primary-pressed | `#9DC5FF` | `#9CC6FF` | 0.28 |
| escuro | link | `#5B9EFD` | `#569FFD` | 0.47 |
| escuro | primary-tint | `#1D3659` | `#1B3659` | 0.22 |
| escuro | primary-tint-foreground | `#5C9FFE` | `#569FFD` | 0.56 |
| escuro | ring | `#5B9EFD` | `#569FFD` | 0.47 |

Depois: se um par falha, mexe-se só no L (passos de 0,001), para o lado que sobe o contraste: primary (com hover/pressed atrás) até o texto passar nos três; link até ≥ 4,5 no background **e** no card; tint-foreground até ≥ 4,5 no tint e ≥ 3 como contorno (Tema 3) no background e no card. Amostras: botão, texto e etiqueta são os aprovados (DECISIONS / Figma «Cor · 4»); hover/pressed seguem o padrão do azul Claro se o texto é branco (escurece) e o do Escuro se o texto é escuro (clareia); ring = link.

## Tabelas

Colunas: valor (contraste). fg = texto sobre primary · link = sobre background / card · tint-fg = sobre tint · contorno = tint-fg sobre background / card.

### Cores do sistema

| Cor | Modo | primary | fg | hover / pressed (fg) | link (bg / card) | tint | tint-fg (tint · contorno bg/card) |
|---|---|---|---|---|---|---|---|
| grafite | claro | `#767676` | `#FFFFFF` 4.54 | `#6A6A6A` 5.41 / `#5E5E5E` 6.48 | `#707070` 4.95 / 4.55 | `#EBEBEB` | `#6A6A6A` 4.54 · 5.41 / 4.97 |
| grafite | escuro | `#B0B0B0` | `#1A1A1A` 8.03 | `#BFBFBF` 9.46 / `#CFCFCF` 11.17 | `#A9A9A9` 7.09 / 6.09 | `#353535` | `#A9A9A9` 5.22 · 7.09 / 6.09 |
| vermelho | claro | `#BC2E33` | `#FFFFFF` 5.87 | `#A8292D` 6.95 / `#942427` 8.27 | `#BC2E33` 5.87 / 5.39 | `#FCE5E3` | `#BB3034` 4.87 · 5.86 / 5.38 |
| vermelho | escuro | `#FF9E99` | `#2D100F` 8.89 | `#FFB7B2` 10.62 / `#FFCFCB` 12.61 | `#FB9590` 7.78 / 6.69 | `#4E2928` | `#FB9590` 5.86 · 7.78 / 6.69 |
| laranja | claro | `#BA5D00` | `#FFFFFF` 4.51 | `#A75405` 5.37 / `#954B09` 6.39 | `#B15800` 4.92 / 4.52 | `#F7E8DE` | `#A75300` 4.52 · 5.41 / 4.97 |
| laranja | escuro | `#FFB98C` | `#291406` 10.50 | `#FFCFB1` 12.37 / `#FFE5D5` 14.55 | `#FBB181` 9.29 / 7.99 | `#492E1D` | `#FBB181` 6.92 · 9.29 / 7.99 |
| amarelo | claro | `#957100` | `#FFFFFF` 4.53 | `#856605` 5.38 / `#765A08` 6.49 | `#8D6C00` 4.91 / 4.51 | `#F0EBDF` | `#866600` 4.51 · 5.37 / 4.93 |
| amarelo | escuro | `#EFCA6E` | `#231900` 11.02 | `#F9DB93` 12.87 / `#FFEDC3` 15.00 | `#EAC25F` 9.83 / 8.45 | `#42330E` | `#EAC25F` 7.23 · 9.83 / 8.45 |
| verde | claro | `#3C8622` | `#FFFFFF` 4.54 | `#36781F` 5.44 / `#306A1C` 6.55 | `#36801A` 4.93 / 4.53 | `#E4EFE1` | `#327A16` 4.51 · 5.34 / 4.91 |
| verde | escuro | `#9ED98D` | `#0D2008` 10.40 | `#B5E6A8` 12.10 / `#CDF3C3` 14.02 | `#94D383` 9.45 / 8.12 | `#263C1F` | `#94D383` 6.81 · 9.45 / 8.12 |
| azul | claro | `#0066D6` | `#FFFFFF` 5.42 | `#005BBF` 6.46 / `#0050A8` 7.74 | `#0066D6` 5.42 / 4.98 | `#E0ECFE` | `#0666D4` 4.56 · 5.44 / 5.00 |
| azul | escuro | `#62A6FF` | `#051A36` 6.97 | `#7FB6FF` 8.31 / `#9CC6FF` 9.88 | `#569FFD` 6.17 / 5.30 | `#1B3659` | `#569FFD` 4.52 · 6.17 / 5.30 |
| roxo | claro | `#792F7A` | `#FFFFFF` 8.40 | `#6A276A` 9.95 / `#5A205B` 11.72 | `#792F7A` 8.40 / 7.71 | `#F3E6F2` | `#783079` 6.97 · 8.41 / 7.72 |
| roxo | escuro | `#BD82BD` | `#251225` 5.95 | `#C696C6` 7.20 / `#D0AAD0` 8.68 | `#B97BBA` 5.24 / 4.51 | `#432C43` | `#C586C5` 4.52 · 6.03 / 5.18 |
| rosa | claro | `#CD4082` | `#FFFFFF` 4.51 | `#B93B76` 5.32 / `#A53669` 6.30 | `#C6397D` 4.90 / 4.50 | `#FBE4EC` | `#BC3275` 4.52 · 5.45 / 5.01 |
| rosa | escuro | `#FF98C0` | `#2D0E1B` 8.83 | `#FFB3CF` 10.59 / `#FFCCDE` 12.56 | `#FB8FBA` 7.73 / 6.64 | `#4E2737` | `#FB8FBA` 5.83 · 7.73 / 6.64 |

### Amostras

| Cor | Modo | primary | fg | hover / pressed (fg) | link (bg / card) | tint | tint-fg (tint · contorno bg/card) |
|---|---|---|---|---|---|---|---|
| azul-tinta | claro | `#2C5A8C` | `#FFFFFF` 7.12 | `#254E7B` 8.56 / `#1F436A` 10.15 | `#2C5A8C` 7.12 / 6.54 | `#DEEDFF` | `#2C5A8C` 5.99 · 7.12 / 6.54 |
| azul-tinta | escuro | `#8DB6E8` | `#111B28` 8.25 | `#A3C5EE` 9.72 / `#BAD5F5` 11.50 | `#8DB6E8` 7.93 / 6.81 | `#293647` | `#8DB6E8` 5.83 · 7.93 / 6.81 |
| verde-folha | claro | `#3FA34D` | `#06210A` 5.33 | `#62AE69` 6.33 / `#81BA84` 7.56 | `#13822D` 4.93 / 4.53 | `#D8F4D9` | `#047C26` 4.56 · 5.36 / 4.92 |
| verde-folha | escuro | `#3FA34D` | `#06210A` 5.33 | `#62AE69` 6.33 / `#81BA84` 7.56 | `#40A44E` 5.27 / 4.53 | `#1E3E21` | `#52B55E` 4.60 · 6.45 / 5.55 |
| turquesa | claro | `#1FA5A0` | `#00201F` 5.67 | `#56B1AC` 6.75 / `#7BBDB9` 8.01 | `#007E7A` 4.92 / 4.52 | `#D4F3F0` | `#0B7773` 4.58 · 5.38 / 4.94 |
| turquesa | escuro | `#1FA5A0` | `#00201F` 5.67 | `#56B1AC` 6.75 / `#7BBDB9` 8.01 | `#1FA5A0` 5.52 / 4.74 | `#173C3B` | `#31B0AB` 4.54 · 6.29 / 5.41 |
| laranja | claro | `#F07A2A` | `#2F1100` 6.26 | `#F3925A` 7.55 / `#F6AA80` 9.14 | `#B75400` 4.90 / 4.50 | `#FFE5D8` | `#AB4E02` 4.57 · 5.49 / 5.05 |
| laranja | escuro | `#F07A2A` | `#2F1100` 6.26 | `#F3925A` 7.55 / `#F6AA80` 9.14 | `#F07A2A` 5.97 / 5.13 | `#512A12` | `#F27C2C` 4.55 · 6.11 / 5.25 |
| amarelo | claro | `#F2C230` | `#231900` 10.35 | `#FAD46D` 12.15 / `#FFE6A8` 14.16 | `#8B6D00` 4.90 / 4.50 | `#F8EAC8` | `#836601` 4.55 · 5.43 / 4.99 |
| amarelo | escuro | `#F2C230` | `#231900` 10.35 | `#FAD46D` 12.15 / `#FFE6A8` 14.16 | `#F2C230` 9.95 / 8.55 | `#423305` | `#F2C230` 7.34 · 9.95 / 8.55 |
| rosa | claro | `#E8559A` | `#2F0C1C` 5.21 | `#EB74A8` 6.38 / `#ED90B6` 7.78 | `#C8357F` 4.92 / 4.52 | `#FFE2EC` | `#BE2B76` 4.57 · 5.53 / 5.08 |
| rosa | escuro | `#E8559A` | `#2F0C1C` 5.21 | `#EB74A8` 6.38 / `#ED90B6` 7.78 | `#EE5A9F` 5.24 / 4.50 | `#502537` | `#FA65A9` 4.52 · 5.95 / 5.12 |
| violeta | claro | `#9866EC` | `#1E1332` 4.56 | `#A37EEA` 5.63 / `#AF95E8` 6.94 | `#8853D8` 4.91 / 4.51 | `#EDE7FF` | `#7F4BCF` 4.59 · 5.51 / 5.06 |
| violeta | escuro | `#9866EC` | `#1E1332` 4.56 | `#A37EEA` 5.63 / `#AF95E8` 6.94 | `#A676FC` 5.25 / 4.51 | `#3A2D54` | `#B086FE` 4.57 · 6.10 / 5.24 |

## Desvio do botão em relação à cor do sistema

ΔE OKLab (×100) entre o `controlAccentColor` medido e o `primary`. ≥ 10 nota-se bem; ≥ 20 muda de carácter.

| Cor | Modo | medido | primary | ΔE | ΔL | nota |
|---|---|---|---|---|---|---|
| grafite | claro | `#989898` | `#767676` | 11.4 | -0.114 | visível |
| grafite | escuro | `#8C8C8C` | `#B0B0B0` | 11.7 | +0.117 | visível |
| vermelho | claro | `#E0383E` | `#BC2E33` | 7.8 | -0.073 |  |
| vermelho | escuro | `#FF5257` | `#FF9E99` | 14.9 | +0.117 | visível |
| laranja | claro | `#F7821B` | `#BA5D00` | 14.8 | -0.145 | visível |
| laranja | escuro | `#F7821B` | `#FFB98C` | 13.7 | +0.116 | visível |
| amarelo | claro | `#FFC726` | `#957100` | 29.2 | -0.288 | **muda de carácter** |
| amarelo | escuro | `#FFC600` | `#EFCA6E` | 5.6 | -0.001 |  |
| verde | claro | `#62BA46` | `#3C8622` | 15.9 | -0.157 | visível |
| verde | escuro | `#62BA46` | `#9ED98D` | 13.0 | +0.117 | visível |
| azul | claro | `#007AFF` | `#0066D6` | 7.8 | -0.073 |  |
| azul | escuro | `#007AFF` | `#62A6FF` | 13.6 | +0.117 | visível |
| roxo | claro | `#953D96` | `#792F7A` | 7.6 | -0.073 |  |
| roxo | escuro | `#A550A7` | `#BD82BD` | 12.7 | +0.117 | visível |
| rosa | claro | `#F74F9E` | `#CD4082` | 9.4 | -0.089 |  |
| rosa | escuro | `#F74F9E` | `#FF98C0` | 14.3 | +0.116 | visível |

## Ajustes às amostras aprovadas

- verde-folha · claro · `link` → `#13822D`: derivado:aprovado #1B8732 DECISIONS Cor 2 «Amostras vivas» (ligação); escurecido L-0.015 até link ≥ 4,5 no background e no card
- verde-folha · escuro · `link` → `#40A44E`: derivado:aprovado #3FA34D DECISIONS Cor 2 «Amostras vivas» (ligação); clareado L+0.002 até link ≥ 4,5 no background e no card
- turquesa · claro · `link` → `#007E7A`: derivado:aprovado #058480 DECISIONS Cor 2 «Amostras vivas» (ligação); escurecido L-0.018 até link ≥ 4,5 no background e no card
- laranja · claro · `link` → `#B75400`: derivado:aprovado #BD590B DECISIONS Cor 2 «Amostras vivas» (ligação); escurecido L-0.016 até link ≥ 4,5 no background e no card
- amarelo · claro · `link` → `#8B6D00`: derivado:aprovado #907107 DECISIONS Cor 2 «Amostras vivas» (ligação); escurecido L-0.015 até link ≥ 4,5 no background e no card
- rosa · claro · `link` → `#C8357F`: derivado:aprovado #CF3D85 DECISIONS Cor 2 «Amostras vivas» (ligação); escurecido L-0.021 até link ≥ 4,5 no background e no card
- rosa · escuro · `link` → `#EE5A9F`: derivado:aprovado #E8559A DECISIONS Cor 2 «Amostras vivas» (ligação); clareado L+0.016 até link ≥ 4,5 no background e no card
- violeta · claro · `link` → `#8853D8`: derivado:aprovado #8D59DE DECISIONS Cor 2 «Amostras vivas» (ligação); escurecido L-0.018 até link ≥ 4,5 no background e no card
- violeta · escuro · `link` → `#A676FC`: derivado:aprovado #9C6BF1 DECISIONS Cor 2 «Amostras vivas» (ligação); clareado L+0.033 até link ≥ 4,5 no background e no card
