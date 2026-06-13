/**
 * Cloudflare Pages Function: /api/convert-pdf-to-word
 * Proxies PDF → DOCX conversion through CloudConvert API.
 * Requires CLOUDCONVERT_API_KEY secret set via:
 *   npx wrangler secret put CLOUDCONVERT_API_KEY
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse the uploaded PDF from form data
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // Step 1: Create a CloudConvert job (upload + convert + export)
    const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        tasks: {
          "upload-file": {
            operation: "import/upload",
          },
          "convert-file": {
            operation: "convert",
            input: "upload-file",
            input_format: "pdf",
            output_format: "docx",
            engine: "libreoffice",
          },
          "export-file": {
            operation: "export/url",
            input: "convert-file",
          },
        },
      }),
    });

    if (!jobRes.ok) {
      const err = await jobRes.text();
      console.error("CloudConvert job creation failed:", err);
      return new Response(JSON.stringify({ error: "Failed to create conversion job" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const job = await jobRes.json();
    const uploadTask = job.data.tasks.find((t) => t.name === "upload-file");

    if (!uploadTask) {
      return new Response(JSON.stringify({ error: "Upload task not found in job" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 2: Upload the PDF to CloudConvert
    const uploadForm = new FormData();
    // Add all required form fields from CloudConvert's upload endpoint
    for (const [key, value] of Object.entries(uploadTask.result.form.parameters)) {
      uploadForm.append(key, value);
    }
    uploadForm.append("file", file);

    const uploadRes = await fetch(uploadTask.result.form.url, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error("CloudConvert upload failed:", err);
      return new Response(JSON.stringify({ error: "Failed to upload file to converter" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 3: Poll the job until it finishes (max ~60 seconds)
    const jobId = job.data.id;
    let exportTask = null;
    const maxAttempts = 30;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const statusRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers,
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      const tasks = statusData.data.tasks;
      const jobStatus = statusData.data.status;

      if (jobStatus === "error") {
        const failedTask = tasks.find((t) => t.status === "error");
        console.error("Conversion error:", failedTask?.message);
        return new Response(JSON.stringify({ error: "Conversion failed", detail: failedTask?.message }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (jobStatus === "finished") {
        exportTask = tasks.find((t) => t.name === "export-file");
        break;
      }
    }

    if (!exportTask?.result?.files?.[0]) {
      return new Response(JSON.stringify({ error: "Conversion timed out or no output file" }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 4: Fetch the converted DOCX and stream it back to the user
    const docxUrl = exportTask.result.files[0].url;
    const docxFilename = exportTask.result.files[0].filename || "converted.docx";

    const docxRes = await fetch(docxUrl);
    if (!docxRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to download converted file" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(docxRes.body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${docxFilename}"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
