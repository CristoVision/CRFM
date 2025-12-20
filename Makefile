.PHONY: bulk-upload bulk-upload-dry cap-sync ios android

bulk-upload:
	node orchestrator/bulk_upload.mjs --manifest orchestrator/manifest.yml

bulk-upload-dry:
	node orchestrator/bulk_upload.mjs --manifest orchestrator/manifest.yml --dry-run

cap-sync:
	npm run cap:sync

ios:
	npm run ios

android:
	npm run android
