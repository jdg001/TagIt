// async function uploadTemplate(imageFile) {
//     const formData = new FormData();
//     formData.append("image", imageFile);
  
//     const response = await fetch("/api/label/extract-template", {
//       method: "POST",
//       body: formData
//     });
  
//     if (!response.ok) throw new Error("Failed to extract template");
//     return await response.json(); // This will be your LabelSchema JSON
//   }

//   const response = await fetch("/api/labelai/generate-from-prompt", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       prompt: "Label for product X with logo, barcode, and 2 text fields",
//       width: 4,
//       height: 6
//     })
//   });
//   const labelSchema = await response.json();
  