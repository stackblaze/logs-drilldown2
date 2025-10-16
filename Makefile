.PHONY: package build clean deploy-k8s release

# Kubernetes deployment variables
KUBECONFIG ?= shared-services-cluster.yaml
NAMESPACE ?= observability
DEPLOYMENT ?= prometheus-grafana
PLUGIN_NAME = stackblaze-logs-app

package: build
	@echo "Packaging stackblaze-logs plugin..."
	@mkdir -p dist
	@cd dist && zip -r stackblaze-logs-app.zip stackblaze-logs-app/
	@echo "Package created: dist/stackblaze-logs-app.zip"

build:
	@echo "Building stackblaze-logs plugin..."
	yarn build
	@echo "Build complete!"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	@echo "Clean complete!"

release: build
	@echo "Creating release package..."
	@mkdir -p release
	@# Get current version from package.json
	$(eval CURRENT_VERSION := $(shell grep '"version"' package.json | cut -d'"' -f4))
	@# Increment patch version
	$(eval NEW_VERSION := $(shell echo $(CURRENT_VERSION) | awk -F. '{print $$1"."$$2"."$$3+1}'))
	@echo "Current version: $(CURRENT_VERSION)"
	@echo "New version: $(NEW_VERSION)"
	@# Update version in package.json
	@sed -i 's/"version": "$(CURRENT_VERSION)"/"version": "$(NEW_VERSION)"/' package.json
	@# Update version in plugin.json
	@sed -i 's/"version": "%VERSION%"/"version": "$(NEW_VERSION)"/' src/plugin.json
	@# Rebuild with new version
	@echo "Rebuilding with new version..."
	@yarn build
	@# Create release zip
	@cd dist && zip -r ../release/$(PLUGIN_NAME)-$(NEW_VERSION).zip .
	@echo ""
	@echo "✓ Release created: release/$(PLUGIN_NAME)-$(NEW_VERSION).zip"
	@echo "Version updated from $(CURRENT_VERSION) to $(NEW_VERSION)"

deploy-k8s: build
	@echo "Deploying $(PLUGIN_NAME) to Kubernetes cluster..."
	@echo "Finding Grafana pod in namespace $(NAMESPACE)..."
	$(eval POD := $(shell kubectl --kubeconfig=$(KUBECONFIG) -n $(NAMESPACE) get pods -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}' 2>/dev/null))
	@if [ -z "$(POD)" ]; then \
		echo "Error: No Grafana pod found in namespace $(NAMESPACE)"; \
		exit 1; \
	fi
	@echo "Found pod: $(POD)"
	@echo "Copying plugin to pod..."
	@kubectl --kubeconfig=$(KUBECONFIG) -n $(NAMESPACE) cp dist $(POD):/var/lib/grafana/plugins/$(PLUGIN_NAME) -c grafana
	@echo "Plugin copied successfully!"
	@echo "Restarting Grafana process..."
	@kubectl --kubeconfig=$(KUBECONFIG) -n $(NAMESPACE) exec $(POD) -c grafana -- pkill -f grafana-server || true
	@sleep 3
	@echo "Verifying plugin loaded..."
	@kubectl --kubeconfig=$(KUBECONFIG) -n $(NAMESPACE) logs $(POD) -c grafana --tail=50 | grep -i "$(PLUGIN_NAME)" || echo "Check logs manually for plugin status"
	@echo ""
	@echo "✓ Deployment complete!"
	@echo "Access the plugin at: /a/$(PLUGIN_NAME)/explore?var-ds=<datasource-uid>"

