Compressed GLB/GLTF models go here (see README section 4).

  npx gltf-transform optimize in.glb public/models/out.glb \
    --compress draco --texture-compress webp

Render with <GLTFModel url="./models/out.glb" /> inside the scene's <Suspense>.
