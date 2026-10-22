package api

type submitRequest struct{
	Hash string `json:"Hash"`
}

type statusResponse struct{
	Hash string `json:"hash"`
	Status string `json:"status"`
}

type verifyResponse struct{
	Valid bool `json:"valid"`
	Reason string `json:"reason,omitempty"`
}

type errorResponse struct{
	Error string `json:"error"`
}
