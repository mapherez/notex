use nox_mcp::{validate_schema, BrokerError, BrokerOptions, RequestBroker};
use serde_json::Value;
use std::time::Duration;
#[test]
fn shared_json_schema_cases() {
    let cases: Vec<Value> = serde_json::from_str(include_str!("../contracts/cases.json")).unwrap();
    for case in cases {
        let source = match case["schema"].as_str().unwrap() {
            "request" => include_str!("../contracts/request.schema.json"),
            "response" => include_str!("../contracts/response.schema.json"),
            "server" => include_str!("../contracts/server.schema.json"),
            "desktop" => include_str!("../contracts/desktop.schema.json"),
            "error" => include_str!("../contracts/error.schema.json"),
            _ => panic!(),
        };
        let schema: Value = serde_json::from_str(source).unwrap();
        assert_eq!(
            validate_schema(&schema, &case["value"]),
            case["valid"].as_bool().unwrap(),
            "{}",
            case["name"]
        );
    }
}
#[tokio::test]
async fn timeout_invalidates_work_and_payload_limit_counts_the_envelope() {
    let broker = RequestBroker::<Value>::new(BrokerOptions {
        timeout: Duration::from_millis(5),
        ..BrokerOptions::default()
    });
    let mut id = String::new();
    assert_eq!(
        broker
            .dispatch("echo".into(), serde_json::json!({}), |event| {
                id = event.request_id.clone();
                Ok(())
            })
            .await,
        Err(BrokerError::Timeout)
    );
    assert!(!broker.is_pending(&id).await);
    assert_eq!(
        broker.respond(&id, Value::Null).await,
        Err(BrokerError::UnknownRequest)
    );
    let small = RequestBroker::<Value>::new(BrokerOptions {
        max_payload_bytes: 2,
        ..BrokerOptions::default()
    });
    assert_eq!(
        small
            .dispatch("echo".into(), serde_json::json!({}), |_| panic!(
                "must not deliver oversized envelope"
            ))
            .await,
        Err(BrokerError::InvalidRequest)
    );
}
