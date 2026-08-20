# Kartendrehung schwungvoller — Design

Datum: 2026-08-20
Status: freigegeben, umgesetzt

## Ziel

Die Drehung wirkte schlicht. Sie soll hochwertiger wirken, ohne die zuvor behobene
Unschärfe zurückzuholen und ohne ins Verspielte zu kippen.

## Randbedingung aus dem Unschärfe-Fix

Der Schatten darf **nicht** zurück auf die rotierende Fläche. Ein Schatten ohne
`shadowPath` zwingt iOS zum Offscreen-Rendern; zusammen mit der 3D-Drehung wird das
Ergebnis als Bitmap zwischengespeichert und verzerrt dargestellt.

## Verworfen: Schattenwurf unter der Karte

Ursprünglich vorgesehen war ein weicher Schatten auf einer eigenen, nicht rotierenden
Ebene unter der abhebenden Karte. Beim Entwurf verworfen: Der Bildschirmhintergrund ist
`colors.dark` (#0A0A0A). Ein Schlagschatten auf nahezu Schwarz ist unsichtbar — der
Aufwand ginge in einen Effekt, den niemand sieht.

**Stattdessen Parallaxe:** Die Karten hinter der obersten treten zurück (kleiner und
dunkler), während sie aufsteigt, und kommen beim Landen zurück. Das liest auf dunklem
Grund als Tiefe.

## Ablauf (640 ms)

| Phase | Dauer | Was passiert |
|---|---|---|
| Wegfliegen | 160 ms | Die gespielte Karte kippt auf -12 Grad, steigt kurz und fällt dann — ein flacher Bogen statt eines flachen Rutschens — und verlässt den Bildschirm nach links |
| Abheben | 150 ms | Die neue Karte steigt 20 pt; der Stapel dahinter tritt zurück (Skalierung -5 % bzw. -9 %, Deckkraft -35 % bzw. -50 %) |
| Drehen | 330 ms | `rotateY` läuft mit `Easing.out(cubic)` auf 188 Grad, also über die Vorderseite hinaus, und federt dann per Spring auf 180 zurück |
| Landen | Spring | Karte und Stapel federn zurück; der Stapel fächert dabei kurz stärker auf und schnappt zu |

Der Überschwung ist das Kernstück: Er gibt der Drehung Gewicht, statt sie wie ein
Umschalten wirken zu lassen.

## Was unverändert bleibt

- Perspektive 1800 und der Verzicht auf Schatten und Scale-Bump auf der rotierenden
  Fläche — beides war der Unschärfe-Fix.
- Die Sperre gegen Mehrfach-Taps während der Animation.
- Kartengestaltung, Ziehlogik, Bewertung.

## Nicht enthalten

- Lichtreflex über die Kartenfläche (wäre mit `react-native-svg` möglich, wurde bewusst
  nicht gewählt — näher an Gaming-Optik)
- Haptisches Feedback (`expo-haptics` ist nicht im Projekt)
