.PHONY: bulk-upload bulk-upload-dry

bulk-upload:
	node orchestrator/bulk_upload.mjs --manifest orchestrator/manifest.yml

bulk-upload-dry:
	node orchestrator/bulk_upload.mjs --manifest orchestrator/manifest.yml --dry-run

