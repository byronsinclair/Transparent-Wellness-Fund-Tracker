;; AuditLogger.clar - Immutable event logging for wellness fund actions

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-EVENT u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-INVALID-FUND-ID u103)
(define-constant ERR-INVALID-PRINCIPAL u104)
(define-constant ERR-INVALID-TIMESTAMP u105)
(define-constant ERR-LOG-ENTRY-NOT-FOUND u106)
(define-constant ERR-MAX-LOGS-EXCEEDED u107)

(define-data-var log-counter uint u0)
(define-data-var max-logs uint u10000)
(define-data-var logger-authority principal tx-sender)

(define-map event-logs
  uint
  {
    event-type: (string-ascii 30),
    fund-id: uint,
    sender: principal,
    amount: uint,
    timestamp: uint,
    block-height: uint,
    tx-id: (buff 32)
  })

(define-map logs-by-fund
  uint
  (list 1000 uint))

(define-map logs-by-sender
  principal
  (list 1000 uint))

(define-read-only (get-log (log-id uint))
  (map-get? event-logs log-id))

(define-read-only (get-logs-by-fund (fund-id uint) (offset uint) (limit uint))
  (let ((log-ids (default-to (list) (map-get? logs-by-fund fund-id))))
    (ok (slice log-ids offset (+ offset limit)))))

(define-read-only (get-logs-by-sender (sender principal) (offset uint) (limit uint))
  (let ((log-ids (default-to (list) (map-get? logs-by-sender sender))))
    (ok (slice log-ids offset (+ offset limit)))))

(define-read-only (get-total-logs)
  (ok (var-get log-counter)))

(define-read-only (get-authority)
  (ok (var-get logger-authority)))

(define-private (validate-event-type (event (string-ascii 30)))
  (if (or
        (is-eq event "fund-created")
        (is-eq event "contribution")
        (is-eq event "proposal-submitted")
        (is-eq event "vote-cast")
        (is-eq event "disbursement")
        (is-eq event "fund-updated")
        (is-eq event "fund-closed"))
      (ok true)
      (err ERR-INVALID-EVENT)))

(define-private (validate-amount (amount uint))
  (if (>= amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT)))

(define-private (validate-fund-id (fund-id uint))
  (if (>= fund-id u0)
      (ok true)
      (err ERR-INVALID-FUND-ID)))

(define-private (validate-principal-param (p principal))
  (if (not (is-eq p tx-sender))
      (ok true)
      (err ERR-INVALID-PRINCIPAL)))

(define-public (log-event
  (sender principal)
  (event-type (string-ascii 30))
  (fund-id uint)
  (amount uint))
  (let ((log-id (var-get log-counter))
        (current-max (var-get max-logs)))
    (asserts! (or (is-eq tx-sender (var-get logger-authority)) (is-eq tx-sender (as-contract tx-sender))) (err ERR-NOT-AUTHORIZED))
    (asserts! (< log-id current-max) (err ERR-MAX-LOGS-EXCEEDED))
    (try! (validate-event-type event-type))
    (try! (validate-amount amount))
    (try! (validate-fund-id fund-id))
    (try! (validate-principal-param sender))
    (let ((new-log {
            event-type: event-type,
            fund-id: fund-id,
            sender: sender,
            amount: amount,
            timestamp: (get-block-info? time u0),
            block-height: block-height,
            tx-id: tx-id
          }))
      (map-set event-logs log-id new-log)
      (map-set logs-by-fund fund-id
        (unwrap! (as-max-len? (append (default-to (list) (map-get? logs-by-fund fund-id)) log-id) u1000) (err ERR-MAX-LOGS-EXCEEDED)))
      (map-set logs-by-sender sender
        (unwrap! (as-max-len? (append (default-to (list) (map-get? logs-by-sender sender)) log-id) u1000) (err ERR-MAX-LOGS-EXCEEDED)))
      (var-set log-counter (+ log-id u1))
      (print {event: "log-recorded", log-id: log-id, type: event-type})
      (ok log-id))))

(define-public (set-logger-authority (new-authority principal))
  (begin
    (asserts! (is-eq tx-sender (var-get logger-authority)) (err ERR-NOT-AUTHORIZED))
    (var-set logger-authority new-authority)
    (ok true)))

(define-public (set-max-logs (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get logger-authority)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max (var-get log-counter)) (err ERR-INVALID-AMOUNT))
    (var-set max-logs new-max)
    (ok true)))

(define-public (get-log-count-by-fund (fund-id uint))
  (ok (len (default-to (list) (map-get? logs-by-fund fund-id)))))

(define-public (get-log-count-by-sender (sender principal))
  (ok (len (default-to (list) (map-get? logs-by-sender sender)))))

(define-public (search-logs-by-type (event-type (string-ascii 30)) (offset uint) (limit uint))
  (let ((all-ids (fold append
           (map (lambda (id) (let ((log (get-log id)))
                              (if (and (is-some log) (is-eq (get event-type (unwrap! log false)) event-type))
                                  (list id) (list))))
                (range (var-get log-counter)))
           (list))))
    (ok (slice all-ids offset (+ offset limit)))))