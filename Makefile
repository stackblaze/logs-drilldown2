.PHONY: package build clean deploy-k8s

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

