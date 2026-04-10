# Optimizar modelos `.vrm` en Blender 4.2 (VRM Add-on)

Pasos para que tus 10 avatares femeninos se vean y animen mejor con **three-vrm** (spring bones, expresiones, sin T-pose).

## 1. Entorno

1. Instala **Blender 4.2.x** desde [blender.org](https://www.blender.org/).
2. Instala el add-on **VRM for Blender** (p. ej. *VRM_Addon_for_Blender* / extensión `io_scene_vrm`). Descarga el `.zip` desde el repositorio oficial del add-on compatible con Blender 4.2.
3. En Blender: **Edit → Preferences → Add-ons → Install** → elige el `.zip` del add-on → activa **VRM**.

## 2. Importar el VRM

1. **File → Import → VRM 0.x / 1.0** (según tu archivo).
2. Comprueba en **Outliner** que el armature tenga **VRM Humanoid** (Hips, Spine, Chest, etc.).

## 3. Spring bones (cabello, ropa, accesorios)

1. En el panel **VRM** (lateral), abre **Spring Bone** / **Collider Groups**.
2. Asigna **colliders** en torso/cabeza para que el pelo no atraviese el cuerpo.
3. Ajusta **stiffness**, **gravity**, **drag** por cadena de huesos:
   - Cabello: stiffness media, gravedad suave.
   - Faldas/bufandas: más drag, menos stiffness para fluidez.
4. Exporta de nuevo como **VRM** desde el menú del add-on (**Export VRM**).

## 4. Blend shapes / expresiones

1. En **Shape Keys** del mesh facial, mantén nombres compatibles VRM (`Fcl_*` / presets Joy, Fun, Blink, etc.).
2. Evita mezclar demasiados correctivos en un solo key; mejor varios keys moderados.

## 5. Pose de reposo (anti T-pose)

1. En **Pose Mode**, coloca brazos ligeramente hacia abajo (~30–40° desde T-pose), antebrazos naturales.
2. Aplica **Apply Pose as Rest Pose** solo si sabes que no rompes el skinning (haz backup del `.blend`).
3. Alternativa más segura: define **T-pose en A** en el exportador VRM y ajusta **rest pose** en Unity/VRoid antes de export; en Blender, usa **Pose Library** con una pose “idle” y expórtala como referencia.

## 6. Peso e influencias

1. Modo **Weight Paint**: revisa codos, axilas, muñecas (deformaciones limpias).
2. Limita a **máx. 4 huesos por vértice** si el motor lo requiere.

## 7. Export limpio

1. **Export VRM 1.0** (recomendado para web actual).
2. Opciones: incluir **blend shapes**, **spring bones**, **materials MToon/Unlit** según tu pipeline.
3. Prueba el archivo en AVA (`/public/` o tu CDN) y revisa consola por errores de carga.

## 8. IK (opcional en DCC)

El visor web aplica **procedural** sobre humanoid; la **IK de piernas/brazos** completa suele ir en el modelo (VRoid) o en Unity. En Blender puedes usar **Rigify** + retarget, luego bake a animación; para AVA estático basta un **buen rest pose** + spring bones.

---

*Resumen: colliders + spring tuning, blend shapes limpios, rest pose natural, pesos limpios, export VRM1 con spring bones incluidos.*
